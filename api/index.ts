import "dotenv/config";
import express from "express";
import { registerRoutes } from "../server/routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let routesReady = false;

app.use(async (req, res, next) => {
  if (!routesReady) {
    await registerRoutes(app);
    routesReady = true;
  }
  next();
});

export default app;
