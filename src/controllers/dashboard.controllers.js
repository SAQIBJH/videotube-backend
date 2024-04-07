import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { mongoose } from 'mongoose';
import { Video } from './../models/video.model.js';
import {ApiResponse} from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from './../models/like.model.js';
import { Tweet } from './../models/tweet.model.js';

const getChannelVideos = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new ApiError(404, "Unauthorized request");
    const userId = req.user?._id;

    const video = [
        {
            $match: {

                owner: new mongoose.Types.ObjectId(userId)

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
                            username: 1,
                            avatar: "$avatar.url"
                        }
                    }
                ]
            }
        },

        {
            $unwind: "$owner"
        },

        {
            $addFields: {
                videoFile: "$videoFile.url"
            }
        },

        {
            $addFields: {
                thumbnail: "$thumbnail.url"
            }
        },

    ]

    try {
        const allVideos = await Video.aggregate(video);
        console.log("allVideos ::", allVideos);
        return res.status(200).
            json(
                new ApiResponse(
                    200,
                    allVideos,
                    "Video fetched successfully"
            )
        )
    } catch (error) {
        console.error("Error while deleting video:", error);
        throw new ApiError("500", "Server Error while fetching video");
    }
})

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes, total tweets etc.
    
    if(!req.user?._id) throw new ApiError(404, "Unauthorized request");
    const userId = req.user?._id;

    const channelStats = [];

    // total video views
    const videos = await Video.find({ owner: userId });

    channelStats.push({totalVideos : videos.length});
    const totalViews = videos.reduce((acc, curr) => {
        return acc + curr.views
    }, 0);

    channelStats.push({views : totalViews});
    
    // total subscribers
    const userSubscriptions = await Subscription.find({ channel: userId });
    const totalSubscribers = userSubscriptions.length;
    channelStats.push({subscribers : totalSubscribers});


    // total Channel Subscribed by channel owner
    const ChannelSubscriptions = await Subscription.find({ subscriber: userId });
    const totalSubscribedChannel = ChannelSubscriptions.length;
    channelStats.push({ subscribedTo: totalSubscribedChannel });
    
    // console.log("channelStats ::", channelStats);

    const totalUploadedVideos = videos.map(video => video._id);
    console.log("totalUploadedVideos ::", totalUploadedVideos);

    // total likes
    const likes = [];
    for (let videoId of totalUploadedVideos) {
        const likeDocument = await Like.find({ video: videoId });
        likes.push(likeDocument[0]);
        
    }

    channelStats.push({ totalLikes: likes.length });
    
    // total tweets
    const tweets = await Tweet.find({ owner: userId });
    channelStats.push({ totalTweets: tweets.length });

    return res.status(200)
        .json(
            new ApiResponse(
                200,
                channelStats,
                "Channel stats fetched successfully"
        )
    )

  


})

// with aggregation not correct right now I'm working on this
// const getChannelStats = asyncHandler(async (req, res) => {
//   if (!req.user?._id) throw new ApiError(404, "Unauthorized request");
//   const userId = req.user?._id;

//   const channelStats = await Video.aggregate([
//     { $match: { owner: new mongoose.Types.ObjectId(userId) } },
//     {
//       $lookup: {
//         from: "subscriptions",
//         let: { userId: userId },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $or: [
//                   { $and: [{ $eq: ["$channel", "$$userId"] }] },
//                   { $and: [{ $eq: ["$subscriber", "$$userId"] }] },
//                 ],
//               },
//             },
//           },
//           { $group: { _id: null, subscribersCount: { $sum: 1 } } },
//         ],
//         as: "subscriptions",
//       },
//       },

   
//     {
//       $lookup: {
//         from: "likes",
//         localField: "_id",
//         foreignField: "video",
//         as: "likes",
//       },
//     },
//     {
//       $lookup: {
//         from: "tweets",
//         localField: "owner",
//         foreignField: "owner",
//         as: "tweets",
//       },
//       },
    
//     {
//       $project: {
//         totalVideos: { $sum: 1 },
//         views: { $sum: "$views" },
//         subscribers: { $arrayElemAt: ["$subscriptions.subscribers", 0] },
//         subscribedTo: {
//           $size: {
//             $filter: {
//               input: "$subscriptions",
//               cond: { $eq: ["$$this.subscriber", userId] },
//             },
//           },
//         },
//         totalLikes: { $size: "$likes" },
//         totalTweets: { $size: "$tweets" },
//       },
//     },
//   ]);

//     console.log("`first` ::", channelStats);

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         channelStats[0],
//         "Channel stats fetched successfully"
//       )
//     );
// });


export {
    getChannelVideos,
    getChannelStats
}