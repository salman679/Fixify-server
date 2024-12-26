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
    origin: ["http://localhost:5173"],
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

  jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (err, decoded) => {
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
    await client.connect();

    const serviceCollection = client.db("Fixify").collection("Services");
    const bookingCollection = client.db("Fixify").collection("Bookings");

    //auth related apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, { httpOnly: true, secure: false })
        .send({ success: true });
    });

    //clear cookie
    app.get("/logout", (req, res) => {
      res.clearCookie("token").send({ success: true });
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
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    // POST a new Service
    app.post("/add-service", async (req, res) => {
      const job = req.body;
      const result = await serviceCollection.insertOne(job);
      res.send(result);
    });

    // POST a new Booking
    app.post("/add-booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    //GET Bookings by email
    app.get("/bookings", async (req, res) => {
      const email = req.query.email;

      const result = await bookingCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    //manage services
    app.get("/manage-services", async (req, res) => {
      const email = req.query.email;
      const result = await serviceCollection
        .find({ providerEmail: email })
        .toArray();
      res.send(result);
    });

    app.patch("/manage-services/:id", async (req, res) => {
      const id = req.params.id;
      const updatedService = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: updatedService };
      const result = await serviceCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //delete service
    app.delete("/manage-services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    //service provider related apis
    app.get("/services-to-do", async (req, res) => {
      const email = req.query.email;

      const result = await bookingCollection
        .find({ providerEmail: email })
        .toArray();
      res.send(result);
    });

    //status update in service to do
    app.put("/services-to-do/:id", async (req, res) => {
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

    // // UPDATE job by ID
    // app.put("/jobs/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const updatedJob = req.body;
    //   const query = { _id: new ObjectId(id) };
    //   const options = { upsert: true };
    //   const updateDoc = { $set: updatedJob };
    //   const result = await jobCollection.updateOne(query, updateDoc, options);
    //   res.send(result);
    // });

    // // DELETE job by ID
    // app.delete("/jobs/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await jobCollection.deleteOne(query);
    //   res.send(result);
    // });

    // // GET job applications by email
    // app.get("/jobApplications", verifyToken, async (req, res) => {
    //   const email = req.query.email;

    //   if (req.decoded.email !== email) {
    //     return res
    //       .status(403)
    //       .send({ error: true, message: "forbidden access" });
    //   }

    //   const userApplications = await jobApplicationCollection
    //     .find({ email: email })
    //     .toArray();

    //   // Fetch jobs based on jobIds
    //   const jobId = userApplications.map((job) => job.jobId);
    //   const result = await jobCollection
    //     .find({ _id: { $in: jobId.map((id) => new ObjectId(id)) } })
    //     .toArray();

    //   res.send(result);
    // });

    // // POST a new job application
    // app.post("/jobApplications", async (req, res) => {
    //   const jobApplication = req.body;
    //   const result = await jobApplicationCollection.insertOne(jobApplication);
    //   res.send(result);
    // });

    // Ping MongoDB to confirm connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Comment this out for long-running servers
    // await client.close();
  }
}
run().catch(console.dir);
