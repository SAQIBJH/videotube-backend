import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from '../models/user.model.js';
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken';
import mongoose from "mongoose";
import { verifyJWT } from './../middlewares/auth.middleware.js';
import { Subscription } from "../models/subscription.model.js";

const generateAccessandRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId).select("-password -refreshToken");
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        // console.log("user ::", user)
        await user.save({ validateBeforeSave: false })
        // console.log("refreshh Tokenn ::", refreshToken);
        return { accessToken, refreshToken, user };
    } catch (error) {
        throw new ApiError(500, error?.message || "Something went wrong while  generating tokens");
    }

}

const registerUser = asyncHandler(async (req, res) => {
    // get all data from frontend which is send by post request
    const { fullName, username, password, email } = req.body;


    // checking if user provide all details correctly
    if ([fullName, username, password, email].some(field => field?.trim() === "")) throw new ApiError(400, "Please provide all fields");


    // checking if user Already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existingUser) throw new ApiError(409, "User already registered");


    // check user upload its image or not
    const avatarLocalPath = await req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = await req.files?.coverImage?.[0]?.path;


    if (!avatarLocalPath) throw new ApiError(400, "Avatar Image is required")


    var avatar;
    var coverImage;
    try {
        [avatar, coverImage] = await Promise.all(
            [
                await uploadOnCloudinary(avatarLocalPath),
                await uploadOnCloudinary(coverImageLocalPath)
            ]
        )
    } catch (error) {
        console.error("Error while uploading image :: ", error);
        throw new ApiError(500, error?.message || 'Server Error while uploading image to cloudinary');
    }
    const createdUser = await User.create({
        fullName,
        username: username.toLowerCase(),
        password,
        email,
        avatar: { publicId: avatar?.public_id, url: avatar?.url },
        coverImage: { publicId: coverImage?.public_id, url: coverImage?.url || " " }
    })


    if (!createdUser) throw new ApiError(500, error?.message || 'Server Error while creating account');


    // returning response
    return res.status(201).json(new ApiResponse(200, createdUser, "User Registered Successfully")
    )


})

const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!(username || email)) throw new ApiError(400, "username or email is required");

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) throw new ApiError(404, "No User Found!");

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) throw new ApiError(400, "Invalid Password!");
    const { accessToken, refreshToken, user: loggedInUser } = await generateAccessandRefreshTokens(user._id);
    // const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    // console.log("AccessTokenLogin", accessToken);

    // console.log("user Login ::", user);

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(201, {
            user: loggedInUser, refreshToken, accessToken
        },
            "User logged In Successfully"
        )
        )

})

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(req.user._id,
        {
            $unset: {
                refreshToken: 1
            }

        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true,
    }
    return res
        .status(200)
        .clearCookie('accessToken', options)
        .clearCookie('refreshToken', options)
        .json(
            new ApiResponse(200, {}, "User LoggedOut Successfully")
        )
});

const refreshAccessToken = asyncHandler(async (req, res, next) => {
    console.log("incoming refresh token", req.cookies?.refreshToken);
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) throw new ApiError(401, "Invalid Refresh Token");


    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (!decodedToken) throw new ApiError(401, "Invalid Refresh token");

        const user = await User.findById(decodedToken?._id);
        if (!user) throw new ApiError(401, "User not found!");

        if (incomingRefreshToken !== user?.refreshToken) throw new ApiError(401, "Invalid token.");

        const { accessToken, refreshToken } = await generateAccessandRefreshTokens(user._id);



        const options = {
            httpOnly: true,
            secure: true
        }

        res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(200,
                {
                    accessToken, refreshToken
                }, "Access token refreshed"
            ))

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid token");
    }


})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!(oldPassword || newPassword)) throw new ApiError(400, "Invalid oldPassword or newPassword");

    const user = await User.findById(req.user?._id);
    if (!user) throw new ApiError(404, "User Not Found");

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) throw new ApiError(401, "Wrong password entered")

    user.password = newPassword;
    await user.save({ validityBeforeSave: false });
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "User Password has been changed Successfully"));

})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "User profile received successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    console.log("fullName", fullName)
    console.log("email", email)
    if (!(fullName || email)) throw new ApiError(400, "All  fields are required!");
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true, // updated response return
        }
    ).select("-password")
    if (!user) throw new ApiError(404, "User not found!");
    return res
        .status(200)
        .json(new ApiResponse(200, {
            user
        }, "updated Successfully"))
})

// better approach to upload file is to make a seperate endpoint and seperate controller which lowers network consegation
// updating file

const updateUserAvatarImage = asyncHandler(async (req, res) => {
    const { publicId, url } = req?.user?.avatar;
    if (!(publicId || url)) throw new ApiError(404, "Something went wrong while updating user avatar");


    const avatarImageLocalPath = req.file?.path; // for single file we use file not files
    if (!avatarImageLocalPath) throw new ApiError(400, "Please select an image to upload");

    const avatar = await uploadOnCloudinary(avatarImageLocalPath);
    if (!avatar?.url) throw new ApiError(500, "Server Error while Uploading Image on Cloudinary");



    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: {
                    publicId: avatar?.public_id,
                    url: avatar?.url
                }

            }
        },
        {
            new: true
        }
    ).select("-password")

    if (!user) {
        await deleteOnCloudinary(avatar?.url, avatar?.public_id)
        throw new ApiError(404, "User Not Found");
    }

    // console.log("updated user avatar ::", user)
    // console.log("url ::", url, "    publicId ::", publicId)
    if (url) {
        try {
            await deleteOnCloudinary(url, publicId)
        } catch (error) {

            console.log(`Failed to Delete Old Image From Cloudinary Server ${error}`);
            throw new ApiError(500, error?.message || 'Server Error');
        }
    }
    console.log("avatar deleted and updated successfully")



    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar Image Updated Successfully"))
})


const updateUserCoverImage = asyncHandler(async (req, res) => {
    const { publicId, url } = req?.user?.coverImage;
    if (!(publicId || url)) throw new ApiError(404, "Something went wrong while updating user avatar");

    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) throw new ApiError(
        400,
        'No Cover Image provided',
    );

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage?.url) throw new ApiError(
        500,
        'Server error while uploading the cover image'
    )


    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: {
                    publicId: coverImage?.public_id,
                    url: coverImage?.url
                }
            }
        },
        {
            new: true
        }
    ).select("-password");


    if (!user) {
        await deleteOnCloudinary(coverImage?.url, coverImage?.public_id)
        throw new ApiError(404, "User Not Found");
    }

    // delete  the previous image from cloudinary server
    if (url) {
        try {
            await deleteOnCloudinary(url, publicId)
        } catch (error) {

            console.log(`Failed to Delete Old Image From Cloudinary Server ${error}`);
            throw new ApiError(500, error?.message || 'Server Error');
        }
    }

    console.log("deleted and updated successfully")

    return res
        .status(200)
        .json(new ApiResponse(200,
            user,
            "cover Image uploaded Successfully")
        )
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    console.log(username)
    if (!username?.trim()) throw new ApiError(404, "User or channel not found");
    const channel = await User.aggregate(
        [
            {
                $match: {
                    username: username.toLowerCase()
                }
            },
            // stage 2 : get subscriber count

            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            // stage 3 : get subscrib by channel
            {
                $lookup:
                {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            // stage  4 : add isSubscribe field to each document in the array
            {
                $addFields: {
                    subscriberCount: {
                        $size: "$subscribers"
                    },
                    channelsSubscribedToCount: {
                        $size: "$subscribedTo"
                    },
                    isSubscribe: {
                        $cond: {
                            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            // stage 4 : get thr projections data which we want to send from this document;
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    email: 1,
                    isSubscribe: 1,
                    subscriberCount: 1,
                    channelsSubscribedToCount: 1,
                    avatar: "$avatar.url",
                    coverImage: "$coverImage.url"

                }
            }
        ]
    )

    // console.log("channel :: ", channel);
    if (!channel?.length) throw new ApiError("404", "channel doesn't exist");
    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "Channel fetched Successfully"))
})



const getUserWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate(
        [
            {
                $match:
                {
                    _id: new mongoose.Types.ObjectId(req.user?._id)

                }

            },

            {
                $lookup: {
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    pipeline: [
                        {
                            $match: {
                                delted: {
                                    $ne: true
                                }
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
                                            avatar: "$avatar.url",
                                            username: 1,
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


                    ]
                }
            },


            {
                $sort: {
                    "watchedAt": -1
                },
            }

        ]
    )

    if (!user?.length) throw new ApiError(404, "Watch History is empty")

    return res
        .status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "success"))
})





export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatarImage,
    updateUserCoverImage,
    getUserChannelProfile,
    getUserWatchHistory,


};

