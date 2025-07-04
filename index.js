const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const stripe = require('stripe')(process.env.Pyment_GateWay);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.off1efx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const parcelCollection = client.db("parcelDB").collection("parcel");
    const paymentCollection=client.db("parcelDB").collection("payments")

    app.post("/parcels", async (req, res) => {
      const newParcel = req.body;
      const result = await parcelCollection.insertOne(newParcel);
      res.send(result);
    });

    app.get("/parcels", async (req, res) => {
      const userEmail = req.query.email;
      const query = userEmail ? { created_by: userEmail } : {};
      const options = {
        sort: {
          createdAt: -1,
        },
      };
      const result = await parcelCollection.find(query, options).toArray();
      res.send(result);
    });

    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(query);
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const amountInCents =req.body.amountInCents
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          automatic_payment_methods: { enabled: true },
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    
    // post :record payment and update parcel status
    app.post('/payments',async(req,res)=>{
      const{parcelId,email,amount,paymentMethod,transactionId}=req.body;
      const updateResult=await parcelCollection.updateOne(
        {_id: new ObjectId(parcelId)},
        {$set:{payment_status:'paid'}}
      )

      const paymentDoc={
        parcelId,
        email,
        amount,
        paymentMethod,
        transactionId,
        paid_at_string:new Date().toISOString(),
        paid_at:new Date(),

      }
      const result =await paymentCollection.insertOne(paymentDoc)
    })

    app.get('/payments',async(req,res)=>{
      const userEmail=req.query.email;
      const query =userEmail?{email:userEmail}:{};
      const options={sort:{paid_at:-1}}
      const payment =await paymentCollection.find(query,options).toArray();
      res.send(payment)
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

// sample api
app.get("/", (req, res) => {
  res.send("parcel server is running");
});

app.listen(port, () => {
  console.log(`parcel server is running at:${port}`);
});
