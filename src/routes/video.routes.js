import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middleware.js';
import { upload } from "../middlewares/multer.middleware.js";
import { deleteVideo, getAllVideos, getVideoById, publishAVideo, togglePublishStatus, updateVideo } from "../controllers/video.controllers.js";
import { checkOwner } from "../middlewares/owner.middleware.js";
import { Video } from "../models/video.model.js";

const router = Router();
router.use(verifyJWT); // every routes will be protected
router.route("/")
    .get(getAllVideos)
    .post(upload.fields([
        {
            name: "videoFile",
            maxCount:1
        }, {
            name: "thumbnail",
            maxCount:1
        }
    ]),
        publishAVideo
    )

router.route("/:videoId")
    .get(getVideoById)
    .all(checkOwner('videoId', Video))
    .delete(deleteVideo)
    .patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);







export default router;
