const asyncHandler = (requestHandler) => {
    return (req, res, next) => Promise.resolve(requestHandler(req, res, next))
        .catch(err => next(err));
}
export { asyncHandler };
    
// using try catch
// const asyncHandler = (requestHandler) => {
//     return async (err,req,res,next) => {
//         try {
//             await requestHandler(err, req, res, next);
//         } catch (error) {
//             res.status(error.status || 500).json({
//                 success: false,
//                 message:error.message
//             })
//             }
//         }
//     }
                        