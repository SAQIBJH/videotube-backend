import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
    // console.log("req user id ::", req.cookies);
    const { content } = req.body;
    if (!content || content?.trim() === "") throw new ApiError(404, "content is required");
    

    const user = await User.findById(req.user?._id, {_id : 1});
    if (!user) throw new ApiError(404, "User not found");


    const tweet = await Tweet.create({
        content,
        owner : req.user?._id
    })

    if(!tweet) throw new ApiError(500, "Something went wrong while creating tweet")
    
    return res.status(200)
        .json(new ApiResponse(
            200,
            tweet,
            "Tweet created successfully"
    ))
    
})


const getAllTweets = asyncHandler(async (req,res) => {
    const { userId } = req.params;
    if (!userId) throw new ApiError(404, "userId is required");
    if (!isValidObjectId(userId)) throw new ApiError(404, "UserId not valid");
    
    const { page = 1, limit = 10 } = req.query;
    
    const user = await User.findById(userId).select("_id");
    if (!user) throw new ApiError(404, "User not found");

    const tweetAggregate = Tweet.aggregate([
        {
            $match: {
                owner : new mongoose.Types.ObjectId(user?._id)
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
            $sort: {
                createdAt: -1
            } 
        }
    ])

    if (!tweetAggregate) throw new ApiError(404, "Tweet not found");

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        customLabels: {
            totalDocs: "totalTweets",
            docs: "tweets"
        },
        $skip: (page - 1) * limit
        
    }

    Tweet.aggregatePaginate(
        tweetAggregate,
        options
    )
    .then(
        result => {
            if (result.length === 0) {
                return res.status(200)
                            .json(new ApiResponse(
                                200,
                                [],
                                "No tweets found"
                            ))
            }
            return res.status(200)
                .json(new ApiResponse(
                    200,    
                    result,
                    "Tweets fetched successfully"
                )
            )
        }

    )
    .catch(error => {
        console.error("Error in aggregation:", error);
        throw new ApiError(500, error?.message || "Internal server error in tweet aggregation");
    })

    


})


const updateTweet = asyncHandler(async (req,res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(tweetId)) throw new ApiError(404, "Not found tweet for this id")
    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User not found");

    const tweet = await Tweet.findById(tweetId, { _id : 1});
    if (!tweet) throw new ApiError(404, "Tweet not found");

    if(!content || content?.trim() === "") throw new ApiError(404, "content is required");


    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content
            }
        },
        {
            new : true
        }
    )

    if(!updatedTweet) throw new ApiError(500, "Something went wrong while updating tweet")
    
    return res.status(201)
        .json(new ApiResponse(
            201,
            updatedTweet,
            "tweet updated Successfully"
    ))
})


const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User not found");
    
    if (!isValidObjectId(tweetId))
        throw new ApiError(404, "Not found tweet for this id")

    const tweet = await Tweet.findById(tweetId, { _id: 1 });
    if (!tweet) throw new ApiError(404, "Tweet not found");


    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
    if(!deletedTweet) throw new ApiError(500, "Something went wrong while deleting tweet")

    return res.status(200)
        .json(new ApiResponse(
            200,
            {},
            "tweet deleted successfully"
    ))
    
})

export {
    createTweet,
    getAllTweets,
    updateTweet,
    deleteTweet
}