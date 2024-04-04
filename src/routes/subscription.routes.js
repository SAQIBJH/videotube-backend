import express from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {getSubscribedChannelsByOwner, getUserSubscribedChannels, toggleSubscription } from "../controllers/subscription.controllers.js";
const router = express.Router();

router.use(verifyJWT);

router.route("/c/:channelId")
    .get(getUserSubscribedChannels)
    .post(toggleSubscription)

router.route("/u/:subscriberId").get(getSubscribedChannelsByOwner)




export default router;