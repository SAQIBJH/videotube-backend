import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";


// return list of subscriber to channel
const getUserSubscribedChannels = asyncHandler(async (req, res) => {


    // TODO: get all subscribed channels
    const { channelId } = req.params;
    if (!isValidObjectId(channelId)) throw new ApiError(401, "Invalid channel Id");


    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User not found");

    const pipeline =
        [
            {
                $match: {
                    channel: new mongoose.Types.ObjectId(channelId)
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "subscriber",
                    foreignField: "_id",
                    as: "subscriber",
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
                    subscriber: {
                        $first: "$subscriber",
                    },
                },
            },

        ]


    try {
        const subscribers = await Subscription.aggregate(pipeline);
        const subscribersList = subscribers.map(item => item.subscriber)
        return res.status(200)
            .json(
                new ApiResponse(
                    200,
                    subscribersList,
                    "Subscribers List fetched successfully"
                )

            )

    } catch (error) {
        console.log("getUserSubscribedChannels error ::", error)
        throw new ApiError(
            500,
            error?.message || "Internal server error in getUserSubscribedChannels"
        )
    }


})


// suscribe or unsubscribe controller
const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    if (!isValidObjectId(channelId)) throw new ApiError(401, "Invalid channel Id");
    if (!req.user?._id) throw new ApiError(401, "Unauthorized user");
    const subscriberId = req.user?._id;

    const isSubscribed = await Subscription.findOne({ channel: channelId, subscriber: subscriberId });
    var response;
    try {
        response = isSubscribed
            ?
            await Subscription.deleteOne({ channel: channelId, subscriber: subscriberId })
            :
            await Subscription.create({ channel: channelId, subscriber: subscriberId });
    } catch (error) {
        console.log("toggleSubscription error ::", error)
        throw new ApiError(500, error?.message || "Internal server error in toggleSubscription")

    }

    return res.status(200)
        .json(
            new ApiResponse(
                200,
                response,
                isSubscribed === null ? "Subscribed successfully" : "Unsubscribed successfully"

            )
        )




})


// controllers return list of channel subscribe by the channel owner(user)
const getSubscribedChannelsByOwner = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;
    if (!isValidObjectId(subscriberId)) throw new ApiError(401, "Invalid subscriber Id");
    if (!req.user?._id) throw new ApiError(401, "Unauthorized user");

    const pipeline =
        [
            {
                $match: {
                    subscriber: new mongoose.Types.ObjectId(subscriberId),
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "channel",
                    foreignField: "_id",
                    as: "subscribedTo",
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
                $unwind: "$subscribedTo"
            },
            {
                $project: {

                    subscribedChannel: "$subscribedTo"
                }
            }
        ]

    try {
        const channelSubscribedTo = await Subscription.aggregate(pipeline);
        const channelSubsByOwnerList = channelSubscribedTo.map(item => item.subscribedChannel)

        return res.status(200)
            .json(
                new ApiResponse(
                    200,
                    channelSubsByOwnerList,
                    "Channels Subscribed By owner fetched successfully"
                )
            )

    } catch (error) {
        console.log("getSubscribedChannelsByOwner error ::", error)
        throw new ApiError(
            500,
            error?.message || "Internal server error in getSubscribedChannelsByOwner"
        )
    }




})




export {
    getUserSubscribedChannels,
    toggleSubscription,
    getSubscribedChannelsByOwner,
}



