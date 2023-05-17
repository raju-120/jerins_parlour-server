const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config() 

const port = process.env.PORT||5000;

//middleware
app.use(cors())
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5x7kefx.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});




async function run(){
    try{

    }
    finally{

    }
}

run().catch(console.log());

app.get('/', async(req, res)=>{
    res.send('jerins parlour server is running');
});

app.listen(port, ()=> console.log(`Jerin Parlour running on ${port}`))