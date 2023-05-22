const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config() 
const stripe = require("stripe")(process.env.STRIPE_SECRET_key);


const port = process.env.PORT||5000;

//middleware
app.use(cors())
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5x7kefx.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


function verifyJWT(req, res, next){
   //console.log('token inside jwt' ,req.headers.authorization);
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(403).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
    })

} 

async function run(){
    try{
        const appointmentOptionCollection = client.db('jerinParlour').collection('appointmentOption');
        const bookingsCollection = client.db('jerinParlour').collection('bookings');
        const usersCollection = client.db('jerinParlour').collection('users');
        const employeesCollection = client.db('jerinParlour').collection('employees');
        const paymentsCollection = client.db('jerinParlour').collection('payments');


        //Admin role check in 

        const verifyAdmin = async(req, res, next)=>{
            console.log('Inside the verifyAdmin',req.decoded.email);
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail};
            const user = await usersCollection.findOne(query);
            
            if(user?.role !== 'admin'){
                return res.status(403).send({message: 'forbidden access'})
            }
            

        }

        // Use aggregate to query multiple collection and then merge data
        app.get('/appointmentOption', async(req, res) =>{
            const date= req.query.date;
            const query = {};
            const options = await appointmentOptionCollection.find(query).toArray();
            
            //get the booking of the provided date
            const bookingQuery = {appointmentDate: date};
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            
            //find out the slots booked into the loop
            options.forEach(option =>{
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionBooked.map(book => book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
            })
            res.send(options);
        });

        app.get('/appointmentSpecialty', async (req,res) =>{
            const query= {};
            const result = await appointmentOptionCollection.find(query).project({name: 1}).toArray();
            res.send(result)
        })


        app.get('/bookings',verifyJWT, async(req, res) =>{
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if(email !== decodedEmail){
                return res.status(403).send({message: 'forbidden access'})
            }

            const query = {email: email};

            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        })

        app.get('/bookings/:id', async( req, res) =>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const booking = await bookingsCollection.findOne(query);
            res.send(booking);
        })

        app.post('/bookings', async(req, res) =>{
            const booking = req.body;
            //console.log(booking);
            const query ={
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }

            const alreadyBooked =  await bookingsCollection.find(query).toArray();

            if(alreadyBooked.length){
                const message = `You already have a booking on ${booking.appointmentDate}`;
                return res.send({acknowledged: false, message})
            }

            const result = await bookingsCollection.insertOne(booking);
            res.send(result)
        });

        app.post('/create-payment-intent', async (req, res) =>{
            const booking = req.body;
            const price = booking.price;
            const amount = price*100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                  ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
              });
        })

        app.post('/payments', async(req, res) =>{
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId;
            const filter = {_id: new ObjectId(id)};
            const updatedDoc = {
                $set:{
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updateResult = await bookingsCollection.updateOne(filter,updatedDoc);
            res.send(result);
        })

        app.get('/jwt', async(req,res) =>{
            const email =  req.query.email;
            const query = {email:  email}
            const users = await usersCollection.findOne(query);
            if(users){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '365d'});
                return res.send({accessToken: token});
            }
            //console.log(users);
            res.status(403).send({accessToken: 'token'})
        });

        app.get('/users', async(req, res)=>{
            const query ={};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        app.post('/users', async(req, res) =>{
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        //Admin Access handling

        app.get('/users/admin/:email', async (req, res) =>{
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({isAdmin: user?.role === 'admin'})
        })

        app.put('/users/admin/:id',verifyJWT, async(req, res) =>{
            const decodedEmail = req.decoded.email;
            console.log('check in',decodedEmail);
            const query = {email: decodedEmail};
            const user = await usersCollection.findOne(query);
            
            if(user?.role !== 'admin'){
                return res.status(403).send({message: 'forbidden access'})
            }
            
            
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result)
        })

        //employees information 
        
        app.get('/employees', async (req, res) =>{
            const query = {};
            const result = await employeesCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/employees/:id',verifyJWT, async(req, res) =>{
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await employeesCollection.deleteOne(filter);
            res.send(result);
        })

        app.post('/employees',verifyJWT, async(req, res) =>{
            const employee = req.body;
            const result = await employeesCollection.insertOne(employee);
            res.send(result);
        })
    }
    finally{

    }
}

run().catch(console.log());

app.get('/', async(req, res)=>{
    res.send('jerins parlour server is running');
});

app.listen(port, ()=> console.log(`Jerin Parlour running on ${port}`))