import { Video } from "../models/video.model.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/AsyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Like } from "../models/like.model.js";


const getAllVideos = asyncHandler(async (req, res) => {
    // TODO: get all videos based on query, sort, pagination
    const { page = 1,
        limit = 10,
        query = "",
        sortBy = "createdAt",
        sortType = 1,
        userId } = req.query;

    // dont use await because it will be not able to populate properly with aggregate pipeline in the next step 
    const matchCondition = {
        $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    };

    if (userId) {
        matchCondition.owner = new mongoose.Types.ObjectId(userId);
    }
    var videoAggregate;
    try {
        videoAggregate = Video.aggregate(
            [
                {
                    $match: matchCondition

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
                                    _id :1,
                                    fullName: 1,
                                    avatar: "$avatar.url",
                                    username: 1,
                                }
                            },

                        ]
                    }

                },

                {
                    $addFields: {
                        owner: {
                            $first: "$owner",
                        },
                    },
                },

                {
                    $sort: {
                        [sortBy || "createdAt"]: sortType || 1
                    }
                },

            ]
        )
    } catch (error) {
        console.error("Error in aggregation:", error);
        throw new ApiError(500, error.message || "Internal server error in video aggregation");
    }




    const options = {
        page,
        limit,
        customLabels: {
            totalDocs: "totalVideos",
            docs: "videos",

        },
        skip: (page - 1) * limit,
        limit: parseInt(limit),
    }

    Video.aggregatePaginate(videoAggregate, options)
        .then(result => {
            // console.log("first")
            if (result?.videos?.length === 0 && userId) {
                return res.status(200).json(new ApiResponse(200, [], "No videos found"))
            }

            return res.status(200)
                .json(
                    new ApiResponse(
                        200,
                        result,
                        "video fetched successfully"
                    )
                )
        }).catch(error => {
            console.log("error ::", error)
            throw new ApiError(500, error?.message || "Internal server error in video aggregate Paginate")
        })




})


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) throw new ApiError(404, "Video not found");

    const findVideo = await Video.findById(videoId);
    if (!findVideo) throw new ApiError(404, "Video not found");

    const user = await User.findById(req.user?._id, { watchHistory : 1 } );
    if (!user) throw new ApiError(404, "User not found");

    // increment count based on watchHistory
      if (!user?.watchHistory.includes(videoId)) {
        await Video.findByIdAndUpdate(
            videoId,
            {

                $inc: { views: 1 },
            },
            {
                new : true
            }

        )
    }

    // adding video to watch history
     await User.findByIdAndUpdate(
        req.user?._id,
        {
            $addToSet: {
                watchHistory : videoId
            }
        },
        {
            new : true
        }
    )
  
   
    
    const video = await Video.aggregate([
        {
            $match: {
                _id : new mongoose.Types.ObjectId(videoId)
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
                            username: 1,
                            avatar: "$avatar.url",
                            fullName: 1,
                            _id: 1
                        }

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
        },
        {
          $addFields: {
            videoFile: "$videoFile.url",
          },
        },
        {
          $addFields: {
            thumbnail: "$thumbnail.url",
          },
        },
    ])
    console.log("video :: ", video[0])
    if (!video) throw new ApiError(500, "Video detail not found");
    return res.status(200).json(
        new ApiResponse(
        200,
        video[0],
        "Fetched video successfully"
        )
    );
});


const publishAVideo = asyncHandler(async (req, res) => {

    const { title, description } = req.body;
    var videoFile;
    var thumbnail;
  try {
      if(!(title && description) || !(title?.trim() && description?.trim())) throw new ApiError(404, "Please provide title and description");
  
      if (!req.files?.videoFile?.[0]?.path && !req.files?.thumbnail?.[0]?.path) throw new ApiError(404, "Please provide video and thumbnail");

  
       [videoFile, thumbnail] = await Promise.all(
          [
          uploadOnCloudinary(req.files?.videoFile?.[0]?.path),
          uploadOnCloudinary(req.files?.thumbnail?.[0]?.path)
          ]
      );
  
      const video = await Video.create({
          title,
          description,
          videoFile: { publicId: videoFile?.public_id, url: videoFile?.url },
          thumbnail: { publicId: thumbnail?.public_id, url: thumbnail?.url },
          owner: req.user?._id,
          duration: videoFile?.duration
      })

     
      



      return res.status(201)
          .json(new ApiResponse(201,
              {
                  ...video._doc,
                  videoFile: videoFile?.url, // Only send the URL of the video file
                  thumbnail: thumbnail?.url    // Only send the URL of the thumbnail
              },
              "Video Published Successfully"
          ))
  } catch (error) {
      try {
        if(videoFile?.url) await deleteOnCloudinary(videoFile?.url, videoFile?.public_id);
        if (thumbnail?.url) await deleteOnCloudinary(thumbnail?.url, thumbnail?.public_id);

      } catch (error) {
          console.error("Error while deleting video :: ", error);
          throw new ApiError(500, error?.message || 'Server Error while deleting video from cloudinary');
      }
      console.error("Error while publishing video :: ", error);
      throw new ApiError(500, error?.message || 'Server Error while uploading video');
    
  }

})


const updateVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params;
    const { title, description } = req.body;
    const thumbnailLocalPath = req.file?.path;


    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id");

    const oldVideo = await Video.findById(videoId, { thumbnail: 1});
    if (!oldVideo) throw new ApiError(404, "No Video Found");

    if (
        !(thumbnailLocalPath || !(!title || title?.trim() === "") || !(!description || description?.trim() === ""))
    ) {
        throw new ApiError(400, "update fields are required")
    }


    // author of the video can update its own video
    // if (oldVideo?.owner?.toString() !== req.user?._id.toString()) throw new ApiError(401, "Unauthorized Request");

    const updatedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!updatedThumbnail) throw new ApiError(500, "thumbnail not uploaded on cloudinary");


    const { publicId, url } = oldVideo?.thumbnail;
    // console.log("oldVide thumb ::", oldVideo?.thumbnail)
    // console.log(publicId, url)
    if (!(publicId || url)) throw new ApiError(500, "old thumbnail url or publicId not found");

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
            new: true
        }
    )

    if (!video) {
        await deleteOnCloudinary(updatedThumbnail?.url, updatedThumbnail?.public_id);
        console.error("video not updated successfully", error)
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
    var deleteVideoFilePromise;
    var deleteThumbnailPromise;
  try {
    // 1. Validate videoId and fetch video details (optimized query)
    const video = await Video.findById(videoId, { videoFile: 1, thumbnail: 1 })
      .select('_id videoFile thumbnail'); // Use aggregation pipeline for efficiency

    if (!video) throw new ApiError(404, "No Video Found");

    // 2. Delete video file and thumbnail from Cloudinary (concurrent calls)
    [deleteVideoFilePromise, deleteThumbnailPromise] = await Promise.all([
      deleteOnCloudinary(video.videoFile.url, video.videoFile.publicId),
      deleteOnCloudinary(video.thumbnail.url, video.thumbnail.publicId)
    ]);

    // 3. Delete video from database
    await Video.findByIdAndDelete(videoId);

      // 4. Remove video from related collections (optimized updates)
         const updatePromises = [
      User.updateMany({ watchHistory: videoId }, { $pull: { watchHistory: videoId } }),
      Comment.deleteMany({ video: videoId }),
      Playlist.updateMany({ videos: videoId }, { $pull: { videos: videoId } }),
      Like.deleteMany({ video: videoId })
    ];

      await Promise.all(updatePromises);
      

    // 5. Handle any remaining tasks (e.g., removing likes)
    // ...

    return res.status(200).json(new ApiResponse(201, {}, "Video Deleted Successfully"));

  } catch (error) {
    console.error("Error while deleting video:", error);

    // Rollback Cloudinary actions if necessary
    try {
      if (deleteVideoFilePromise?.error) await deleteVideoFilePromise.retry(); // Attempt retry
      if (deleteThumbnailPromise?.error) await deleteThumbnailPromise.retry();
    } catch (cloudinaryError) {
      console.error("Failed to rollback Cloudinary deletions:", cloudinaryError);
    }

    throw new ApiError(500, error.message || 'Server Error while deleting video');
  }
});


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id")


    const video = await Video.findById(videoId, { _id: 1, isPublished: 1, owner: 1 });
    if (!video) throw new ApiError(404, "No Video Found")

    if (video?.owner?.toString() !== req.user?._id?.toString()) throw new ApiError(401, "Unauthorized Request")


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