const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const cookie = require("cookie-parser");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(
  cors({
    origin: ["http://localhost:5173", "https://peak-summer-445602-e8.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookie());

app.get("/", (req, res) => {
  res.send("Job portal server is running...");
});

app.listen(port, () => {
  console.log(`Job portal server is running on port ${port}`);
});

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access" });
    }

    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@salman.uweo3xy.mongodb.net/?retryWrites=true&w=majority&appName=Salman`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const serviceCollection = client.db("Fixify").collection("Services");
    const bookingCollection = client.db("Fixify").collection("Bookings");

    //auth related apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, {
        expiresIn: "5h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    //clear cookie
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // GET all Services
    app.get("/services", async (req, res) => {
      const searchTerm = req.query.searchTerm || "";

      const result = await serviceCollection
        .find({ serviceName: { $regex: searchTerm, $options: "i" } })
        .toArray();
      res.send(result);
    });

    // GET Service by ID
    app.get("/services/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);

      res.send(result);
    });

    // POST a new Service
    app.post("/add-service", verifyToken, async (req, res) => {
      const newService = req.body;

      const result = await serviceCollection.insertOne(newService);
      res.send(result);
    });

    // POST a new Booking
    app.post("/add-booking", verifyToken, async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    //GET Bookings by email
    app.get("/bookings", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (req.decoded.email !== email) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const result = await bookingCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    //manage services
    app.get("/manage-services", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (req.decoded.email !== email) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const result = await serviceCollection
        .find({ providerEmail: email })
        .toArray();
      res.send(result);
    });

    app.patch("/manage-services/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedService = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: updatedService };
      const result = await serviceCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //delete service
    app.delete("/manage-services/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    //service provider related apis
    app.get("/services-to-do", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (req.decoded.email !== email) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const result = await bookingCollection
        .find({ providerEmail: email })
        .toArray();
      res.send(result);
    });

    //status update in service to do
    app.put("/services-to-do/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedStatus = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = { $set: updatedStatus };
      const result = await bookingCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    // Ping MongoDB to confirm connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Comment this out for long-running servers
    // await client.close();
  }
}
run().catch(console.dir);
