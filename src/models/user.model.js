import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    avatar: {
        publicId: {
            type: String,
            required: true,
        },
        url: {
            type: String, //cloudinary url
            required: true,
        }
    },
    coverImage: {
         publicId: {
            type: String,
            required: true,
        },
        url: {
            type: String, //cloudinary url
        }
        
    },
    watchHistory: [
        {
        type: Schema.Types.ObjectId,
        ref: "Video"
        },
        {
            watchedAt: {
            type: Date,
            default: Date.now
            }
        }
    ],

    refreshToken: {
        type: String,
    }
}, { timestamps: true });

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
})

userSchema.methods.isPasswordCorrect = async function (password) {
   return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateAccessToken = function () {

    return jwt.sign(
        {
            _id: this._id,
            fullName: this.fullName,
            email: this.email,
            username : this.username
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn : process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id : this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}




export const User = mongoose.model("User", userSchema);