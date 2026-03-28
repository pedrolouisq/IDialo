import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

console.log("Intentando conectar a:", MONGO_URI);

mongoose.connect(MONGO_URI, { 
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000 
})
.then(() => {
    console.log("CONEXIÓN EXITOSA");
    process.exit(0);
})
.catch(err => {
    console.error("CONEXIÓN FALLIDA:", err);
    process.exit(1);
});
