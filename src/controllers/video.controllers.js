import { Video } from "../models/video.model.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import {ApiError} from "../utils/ApiError.js"
import { asyncHandler } from "../utils/AsyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const allVideos = await Video.find();
    console.log(`allVideos: ${JSON.stringify(allVideos)}`);

    if (!allVideos || allVideos.length === 0) throw new ApiError(404, "No Videos Found");
    return res.status(200)
        .json(new ApiResponse(201, {
            allVideos
        },
            "fetched All Videos Successfully"))
});


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) throw new ApiError(404, "Video not found");

    
    const user = await User.findById(req.user?._id);
    if (!user) throw new ApiError(404, "User not found");

    // Check if the user has already watched the video
    if (!user.watchHistory.includes(videoId)) {
        // Increment the view count only if the user hasn't watched the video before
        await Video.findByIdAndUpdate(
            videoId,
            { $inc: { views: 1 } },
            { new: true }
        );

        // Add the video to the user's watch history

        // user?.watchHistory.push(videoId);
        // await user.save({validateBeforeSave: false});
        await User.findByIdAndUpdate(req.user?._id,
            {
                $addToSet: {
                    watchHistory: videoId
                }
            },
            {
                new: true
            }
        )
    }

    // Retrieve the updated video details
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(500, "Video detail not found");

    return res.status(200).json(new ApiResponse(200, video, "Fetched video successfully"));
});


const publishAVideo = asyncHandler(async (req,res) => {
    const { title, description } = req.body;
    if ([title, description].some(field => field?.trim() === "")) throw new ApiError(404, "Please provide title and description");

    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    // console.log(req.files)

    if (!(videoLocalPath || thumbnailLocalPath)) throw new ApiError(404, "Please provide video and thumbnail");
    
    const videoFile = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    // console.log("videoFile ::", videoFile)
    

    if (!(videoFile || thumbnail)) throw new ApiError(500, "video and thumbnail not uploaded successfully");


    // const videoDuration = videoFile.duration;
    // in frontend we will use this functionality to get video duration;
//     function secondsToHMS(seconds) {
//     var hours = Math.floor(seconds / 3600);
//     var minutes = Math.floor((seconds % 3600) / 60);
//     var remainingSeconds = seconds % 60;
//     return { hours: hours, minutes: minutes, seconds: remainingSeconds };
// }

// var durationSeconds = 3609;
// var duration = secondsToHMS(durationSeconds);
// console.log(duration.hours + " hours, " + duration.minutes + " minutes, " + duration.seconds + " seconds");

    

    
    const video = await Video.create({
        title,
        description,
        videoFile: {publicId : videoFile?.public_id, url: videoFile?.url},
        thumbnail: {publicId : thumbnail?.public_id, url: thumbnail?.url },
        owner: req.user?._id,
        duration: videoFile?.duration
    })
    if (!video) {
        await deleteOnCloudinary(videoFile?.url, videoFile?.public_id);
        await deleteOnCloudinary(thumbnail?.url, thumbnail?.public_id);
        throw new ApiError(500, "server Error")
    }
        
    // console.log("video ::  ", video)


    return res.status(201)
        .json(new ApiResponse(201,
            video,
            "Video Published Successfully"
        ))

})

const updateVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params;
    const { title, description } = req.body;
    const thumbnailLocalPath = req.file?.path;


    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id");
    const oldVideo = await Video.findById(videoId, { thumbnail: 1, owner: 1 });
    
    if (!oldVideo) throw new ApiError(404, "No Video Found");
    
    if(
        !(thumbnailLocalPath || !(!title || title?.trim() === "") || !(!description || description?.trim() === ""))
        ){
            throw new ApiError(400, "update fields are required")
        }
        
    
    // author of the video can update its own video
    if (oldVideo?.owner?.toString() !== req.user?._id.toString()) throw new ApiError(401, "Unauthorized Request");
    
    const updatedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!updatedThumbnail) throw new ApiError(500, "thumbnail not uploaded on cloudinary");
    

    const { publicId, url } = oldVideo?.thumbnail;
    // console.log("oldVide thumb ::", oldVideo?.thumbnail)
    // console.log(publicId, url)
    if(!(publicId ||url))throw new ApiError(500, "old thumbnail url or publicId not found");

    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    publicId: updatedThumbnail?.public_id,
                    url: updatedThumbnail?.url
                }
            }

        },
        {
            new : true
        }
    )

    if (!video) {
        await deleteOnCloudinary(updatedThumbnail?.url, updatedThumbnail?.public_id);
       console.error("video not updated successfully",error)
        throw new ApiError(500, "updated video not uploaded on database");
    }

     if (url) {
        try {
            await deleteOnCloudinary(url, publicId)
        } catch (error) {

            console.log(`Failed to Delete Old thumbnail From Cloudinary Server ${error}`);
            throw new ApiError(500, error?.message || 'Server Error');
        }
    }
    return res.status(200)
        .json(new ApiResponse(
            201,
            video,
            "Video Updated Successfully"
    ))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id");

    const video = await Video.findById(videoId, { owner: 1, videoFile: 1, thumbnail: 1 });
    // console.log("video :: ", video)

    if (!video) throw new ApiError(404, "No Video Found");
    
    if (video?.owner?.toString() !== req.user?._id.toString()) throw new ApiError(401, "Unauthorized Request");
    
    const oldVideoFile = video?.videoFile;
    const oldThumbnail = video?.thumbnail;

    if(!(oldVideoFile || oldThumbnail)) throw new ApiError(500, "Something went wrong while deleting video");

    const deletedVideo = await Video.findByIdAndDelete(videoId);
    if (!deletedVideo) throw new ApiError(500, "Something went wrong while deleting video");

    try {
        await deleteOnCloudinary(oldVideoFile?.url, oldVideoFile?.publicId);
        await deleteOnCloudinary(oldThumbnail?.url, oldThumbnail?.publicId);
    } catch (error) {
        throw new ApiError(500, error?.message || 'Server Error');
    }
  
    return res.status(200)
        .json(new ApiResponse(201, {}, "Video Deleted Successfully"))
    
} )

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id")
    

    const video = await Video.findById(videoId, {_id : 1, isPublished: 1, owner: 1});
    if (!video) throw new ApiError(404, "No Video Found")

    if(video?.owner?.toString() !== req.user?._id?.toString()) throw new ApiError(401, "Unauthorized Request")

    
    const toggleVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video?.isPublished
            }
        },
        {
            new: true
        }
    )

    if (!toggleVideo) throw new ApiError(500, "Something went wrong while updating video")
    return res.status(200)
        .json(new ApiResponse(
            201,
            toggleVideo,
            toggleVideo?.isPublished ? "Video Published Successfully" : "Video Unpublished Successfully"
    ))
})

export {
    getAllVideos,
    publishAVideo,
    updateVideo,
    deleteVideo,
    getVideoById,
    togglePublishStatus
}