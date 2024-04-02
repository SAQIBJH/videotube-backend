import express from "express"
import { verifyJWT } from './../middlewares/auth.middleware.js';
import { addComment, deleteComment, getComment, updateComment } from "../controllers/comment.controllers.js";
import { checkOwner } from "../middlewares/owner.middleware.js";
import { Comment } from "../models/comment.model.js";
const router = express.Router();

router.use(verifyJWT);

router.route('/:videoId')
    .get(getComment)
    .post(addComment)
    

router.route('/c/:commentId')
    .all(checkOwner('commentId', Comment))
    .patch(updateComment).
    delete(deleteComment);
export default router;