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
        const appointmentOptionCollection = client.db('jerinParlour').collection('appointmentOption');
        const bookingsCollection = client.db('jerinParlour').collection('bookings');


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
    }
    finally{

    }
}

run().catch(console.log());

app.get('/', async(req, res)=>{
    res.send('jerins parlour server is running');
});

app.listen(port, ()=> console.log(`Jerin Parlour running on ${port}`))