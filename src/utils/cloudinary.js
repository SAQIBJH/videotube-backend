import { v2 as cloudinary } from "cloudinary"
import fs from "fs";
import { ApiError } from "./ApiError.js";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            console.log('no file path provided!');
            return null;
        }
        const response = await cloudinary.uploader.upload(localFilePath, {

            resource_type: "auto", // let Cloudinary automatically determine the type of file
            folder: "ytfeature",
        });
        // console.log(`Image uploaded to Cloudinary with public ID :: ${JSON.stringify(response, null, 2)}}`)
        fs.unlinkSync(localFilePath);  // delete local copy after it's been uploaded to cloudinary
        return response;


    } catch (error) {
        fs.unlinkSync(localFilePath);  // if something happend on uploading delete the file from our server side
        console.log(`Error uploading file to Cloudinary :: ${error}`);
        throw new ApiError(500, error?.message || "Server error");


    }
}

const deleteOnCloudinary = async (oldImageUrl,publicId) => {
    try {

        if (!(oldImageUrl || publicId)) throw new ApiError(404, "oldImageUrl or publicId required");
        
        const result = await cloudinary.uploader.destroy(
            publicId,
            { resource_type: `${oldImageUrl.includes("image") ? "image" : "video"}` },
        )
        console.log("Asset deleted from Cloudinary:", result);

    } catch (error) {
        console.error("Error deleting asset from Cloudinary:", error);
        throw new ApiError(500, error?.message || "Server error");
    }

}
export {
    uploadOnCloudinary,
    deleteOnCloudinary
};