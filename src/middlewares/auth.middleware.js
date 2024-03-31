import { refreshAccessToken } from "../controllers/user.controllers.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import jwt  from 'jsonwebtoken';

export const verifyJWT = asyncHandler(async (req, _, next) => {
   try {
       const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
      //console.log("req header ::", req.header( "Authorization" ));
      //  console.log("token :: ", token);
      if (!token) {
         throw new ApiError(401, "Unauthorized Request");
       }

      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      if(!decodedToken) throw new ApiError(404, "Invalid decoded Token");
       
       const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

     if (!user) throw new ApiError(401, "Invalid Token or User Not Found!");
       req.user = user
       next();
      } catch (error) {
         
      console.error("verifyJWT error", error);
       throw new ApiError(401, error?.message || "Invalid Access Token")
   }
    
});

















