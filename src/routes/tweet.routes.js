import express from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createTweet, deleteTweet, getAllTweets, updateTweet } from "../controllers/tweet.controllers.js";
import { checkOwner } from './../middlewares/owner.middleware.js';
import { Tweet } from "../models/tweet.model.js";
const router = express.Router();


router.use(verifyJWT);


router.route("/")
    .post(createTweet)

router.route("/:userId")
    .get(getAllTweets)

router.route("/:tweetId")
    .all(checkOwner('tweetId', Tweet))  // check owner if user is owner or not 
    .patch(updateTweet)
      .delete(deleteTweet)

export default router;