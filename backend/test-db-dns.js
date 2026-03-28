import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Forzamos un resolvedor de DNS distinto
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

console.log("Intentando conectar con DNS manual...");

mongoose.set('debug', true);
mongoose.connect(MONGO_URI)
.then(() => {
    console.log("CONEXIÓN EXITOSA");
    process.exit(0);
})
.catch(err => {
    console.error("CONEXIÓN FALLIDA:", err);
    process.exit(1);
});
