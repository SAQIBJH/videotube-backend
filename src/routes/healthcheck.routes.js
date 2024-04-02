import express from "express";
import { healthcheck } from "../controllers/healthcheck.controllers.js";
const router = express.Router();

router.route("/").get(healthcheck)

export default router;