import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

// Primer pedido: tráeme los usuarios
app.get('/api/usuarios', async (_req, res) => {
  try {
    const datos = await prisma.usuario.findMany();
    res.json(datos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al leer usuarios' });
  }
});

app.listen(3000, () => console.log('✅ Mesero listo en http://localhost:3000'));