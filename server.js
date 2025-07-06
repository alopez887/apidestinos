import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Aquí irán tus nuevas rutas para el servicio de destinos

app.listen(PORT, () => {
  console.log(`✅ API de reservaciones destino activa en el puerto ${PORT}`);
});