import express from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { addVideoToPlaylist, createPlaylist, deletePlaylist, getPlaylistById, getUserPlaylists, removeVideoFromPlaylist, updatePlaylist } from "../controllers/playlist.controllers.js";
import { checkOwner } from "../middlewares/owner.middleware.js";
import { Playlist } from "../models/playlist.model.js";
const router = express.Router();

router.use(verifyJWT)
router.route("/")
    .post(createPlaylist)

router.route("/:playlistId")
    .get(getPlaylistById)
    .all(checkOwner('playlistId', Playlist))
    .patch(updatePlaylist)
    .delete(deletePlaylist)

router.route("/add/:videoId/:playlistId")
    .patch(checkOwner('playlistId', Playlist), addVideoToPlaylist)

router.route("/remove/:videoId/:playlistId")
    .patch(checkOwner('playlistId', Playlist), removeVideoFromPlaylist)


router.route("/user/:userId").get(getUserPlaylists)






export default router;