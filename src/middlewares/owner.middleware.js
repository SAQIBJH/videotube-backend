import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

export const checkOwner = (resourceKey, model) => asyncHandler(async (req, _, next) => {
    try {
        const resourceId = req.params[resourceKey];
        const resource = await model.findById(resourceId);
        if (!resourceId) throw new ApiError(404, ` resource is not found`)
        if (!resource) throw new ApiError(404, `${resource} resource is not found`)

        if (resource.owner.toString() !== req.user?._id.toString()) {
            throw new ApiError(401, "You are not authorized to access this resource")
        }
        next()

    } catch (error) {
        console.error("Error in owner middleware:", error);
        next(error);
    }
}
)
