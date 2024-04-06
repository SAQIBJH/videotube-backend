import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { Playlist } from './../models/playlist.model.js';
import { Video } from "../models/video.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    if (!(name || description) || !(name.trim() !== "" || description.trim() !== "")) throw new ApiError(400, "name and description required");

    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User not found");


    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user?._id
    })
    if (!playlist) throw new ApiError(500, "Playlist not created");

    return res.status(200)
        .json(
            new ApiResponse(201,
                playlist,
                "Playlist created successfully"
            )
        )
})


const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    if (!isValidObjectId(playlistId)) throw new ApiError(401, "Invalid playlist Id");

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "playlist not found");

    const playlistAggregate = await Playlist.aggregate(
        [
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(playlistId)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "videos",
                    foreignField: "_id",
                    as: "videos",
                    pipeline: [
                        {

                            $match: { deleted: { $ne: true } } // Filter out deleted videos

                        },

                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            fullName: 1,
                                            _id: 1,
                                            avatar: "$avatar.url",
                                            username: 1
                                        },
                                    }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                videoOwner: {
                                    $first: "$owner"
                                }
                            }
                        },
                        {
                            $project: {
                                owner: 0
                            }
                        },

                        {
                            $addFields: {
                                videoFile : "$videoFile.url",
                            }
                        },

                        {
                            $addFields: {
                                thumbnail: "$thumbnail.url"
                            }
                        }
                    
                    ]
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                _id: 1,
                                avatar: "$avatar.url",
                                username: 1
                            },
                        }
                    ]
                }
            },

            {
                $addFields: {
                    owner: {
                        $first: "$owner"
                    }
                }
            }

        ]
    )

    if (!playlistAggregate) throw new ApiError(404, "playlist not found");

    return res.status(200)
        .json(new ApiResponse(
            201,
            playlistAggregate,
            "Playlist fetched successfully"
        ))

})


const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;

    if (!isValidObjectId(playlistId)) throw new ApiError(401, "Invalid playlist Id");

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "playlist not found");

    if (!(name || description) || !(name?.trim() !== "" || description?.trim() !== "")) throw new ApiError(400, "name or description required");

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name,
                description
            }
        },
        {
            new: true
        }
    )
    if (!updatedPlaylist) throw new ApiError(500, "playlist not updated");
    return res.status(200)
        .json(new ApiResponse(
            200,
            updatedPlaylist,
            "Playlist updated successfully"
        ))
})


const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    if (!isValidObjectId(playlistId)) throw new ApiError(401, "Invalid playlist Id");

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "playlist not found");

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
    if (!deletedPlaylist) throw new ApiError(500, "playlist not deleted");
    return res.status(200)
        .json(new ApiResponse(
            200,
            deletedPlaylist,
            "Playlist deleted successfully"
        ))
})


const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { videoId, playlistId } = req.params;
    if (!isValidObjectId(videoId) || !isValidObjectId(playlistId)) throw new ApiError(401, "Invalid video or playlist Id");

    const video = await Video.findById(videoId, { _id: 1 });
    if (!video) throw new ApiError(404, "video not found");

    const playlist = await Playlist.findById(playlistId, { _id: 1 });
    if (!playlist) throw new ApiError(404, "Playlist Not found");

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )

    if (!updatedPlaylist) throw new ApiError(500, "playlist not updated");
    return res.status(200)
        .json(new ApiResponse(
            200,
            updatedPlaylist,
            "Video added to playlist successfully"
        ))


})


const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { videoId, playlistId } = req.params;
    if (!isValidObjectId(videoId) || !isValidObjectId(playlistId)) throw new ApiError(401, "Invalid video or playlist Id");

    const video = await Video.findById(videoId, { _id: 1 });
    if (!video) throw new ApiError(404, "video not found");

    const playlist = await Playlist.findById(playlistId, { _id: 1, videos: 1 });
    if (!playlist) throw new ApiError(404, "Playlist Not found");


    const isVideoInPlaylist = await Playlist.findOne({
        _id: playlistId,
        videos: videoId
    })

    if (!isVideoInPlaylist) throw new ApiError(404, "Video not found in playlist");

    const removedVideoPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )


    if (!removedVideoPlaylist) throw new ApiError(500, "playlist not updated");
    return res.status(200)
        .json(new ApiResponse(
            200,
            removedVideoPlaylist,
            "Video removed from playlist successfully"
        ))


})


const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) throw new ApiError(401, "Invalid user Id");

    const playlist = await Playlist.findOne({ owner: userId });
    if (!playlist) throw new ApiError(404, "Playlist not found");

    const playlistAggregate = await Playlist.aggregate(
        [
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)
                },
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "videos",
                    foreignField: "_id",
                    as: "videos",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            fullName: 1,
                                            username: 1,
                                            avatar: "$avatar.url",
                                        },
                                    },
                                ],
                            },
                        },

                        {
                            $addFields: {
                                videoOwner: {
                                    $first: "$owner"
                                }
                            },
                        },

                        {
                            $unset: "owner"
                        },

                        {
                            $addFields: {
                                videoFile: "$videoFile.url"
                            },
                        },

                        {
                            $addFields: {
                                thumbnail: "$thumbnail.url"
                            },
                        },

                    ]

                },

            },

            {
                $unwind: "$videos"
            },
        ]
    )

    if (!playlistAggregate) throw new ApiError(404, "Playlist not found");

    return res.status(200)
        .json(
            new ApiResponse(
                200,
                playlistAggregate,
                "Playlist fetched successfully"
            )
        )

})



export {
    createPlaylist,
    getPlaylistById,
    updatePlaylist,
    deletePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    getUserPlaylists

}