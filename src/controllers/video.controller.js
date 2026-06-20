import mongoose, {isValidObjectId} from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { APIerror } from "../utils/apiError.js";
import { deleteOldImage, uploadToCloudinary } from "../utils/cloudinary.js";


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)

    const pipeline = []

    pipeline.push(
        {
            $match: {
                isPublished: true
            }
        }
    )

    if(query){
        pipeline.push(
            {
                $match: {
                    $or:{ // filter
                        title: {$regex: query, $options: 'i'}, // regex = regular expression, i = case insensitive
                        description: {$regex: query, $options: 'i'}
                    }
                    
                }
            }
        )
    }

    if(userId){ // showing videos for particular channel
        if(!mongoose.isValidObjectId(userId)){
            throw new APIerror(400, "userId not found")
        }
        pipeline.push(
            {
                $match: {owner: new mongoose.Types.ObjectId(userId)}
            }
        )
    }

    if(sortBy && sortType){
        pipeline.push(
            {
                $sort: {[sortBy]: sortType === "asc" ? 1 : -1} //1 = asc, -1 = desc
            }
        )
    }else{
        pipeline.push(
            {
                $sort: {createdAt: -1}
            }
        )
    }

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            userName: 1,
                            fullName: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                ownerDetails: { 
                    $first: "$ownerDetails" 
                }
            }
        }
    )
    
    const videoAggregate = Video.aggregate(pipeline)

    const videos = await Video.aggregatePaginate(videoAggregate, {
        page: pageNum,
        limit: limitNum
    })

    return res
    .status(200)
    .json(
        new ApiResponse(200, videos, "videos fetched successfully")
    )

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body

    if(
        [title, description].some((field)=>{field?.trim() === ""})
    ){
        throw new APIerror(400, "Fields should not be empty");
    }

    const videoLocalPath = req.files?.videoFile[0].path
    const thumbnailLocalPath = req.files?.thumbnail[0].path

    if(!(videoLocalPath && thumbnailLocalPath)){
        throw new APIerror(400, "Video file and thumbnail file is required")
    }

    const videoFile = await uploadToCloudinary(videoLocalPath)
    const thumbnail = await uploadToCloudinary(thumbnailLocalPath)

    if(!(videoFile && thumbnail)){
        throw new APIerror(400, "Video file and thumbnail file is not uploaded")
    }


    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        owner: req.user._id,
        title,
        description,
        duration: videoFile.duration,
        isPublished: true
    })

    if(!video){
        throw new APIerror(400, "Something went wrong while publishing the video")
    }


    return res
    .status(200)
    .json(
        new ApiResponse(200, video,"Video has been published successfully")
    )

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!videoId?.trim()){
        throw new APIerror(400, "video id is missing");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: {views: 1}
        },
        {new: true}
    )

    if(!updatedVideo){
        throw new APIerror(400, "video not exists");
    }

    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $addToSet: { watchHistory: videoId }
        },
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedVideo, "video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId?.trim()){
        throw new APIerror(400, "video id is missing")
    }
    const {title, description} = req.body

    if(!title || !description){
        throw new APIerror(400, "all fields are required")
    }

    const thumbnailLocalFile = req.file?.path

    if(!thumbnailLocalFile){
        throw new APIerror(400, "thumbnail not uploaded")
    }

    const thumbnail = await uploadToCloudinary(thumbnailLocalFile)

    if(!thumbnail){
        throw new APIerror(400, "something went wrong while uploading updated thumbnail")
    }

    const video = await Video.findById(videoId)
    if(!video){
        throw new APIerror(400, "Video not exists")
    }

    if(video.owner.toString() !== req.user?._id.toString()){
        throw new APIerror(400, "Not authorized to update this video")
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
         {
            $set: {
                title: title,
                description: description,
                thumbnail: thumbnail.url
            }
        }
    )

    await deleteOldImage({ file: video.thumbnail })

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedVideo, "updated video successfully")
    )

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!videoId?.trim()){
        throw new APIerror(400, "video id is missing")
    }

    const video = await Video.findById(videoId)
    if(!video){
        throw new APIerror(400, "Video not exists")
    }

    if(video.owner.toString() !== req.user?._id.toString()){
        throw new APIerror(400, "Not authorized to delete this video")
    }
    
    await Video.findByIdAndDelete(videoId)

    await deleteOldImage({file: video.thumbnail})
    await deleteOldImage({file: video.videoFile}, "video")

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "video deleted successfully")
    )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId){
        throw new APIerror(400, "video id is missing")
    }
    const video = await Video.findById(videoId)
    if(!video){
        throw new APIerror(400, "video not exists")
    }
    if(video.owner.toString() !== req.user?._id.toString()){
        throw new APIerror(400, "Not authorized to toggle publish status")
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !(video.isPublished)
            },
        },
        {new: true}
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedVideo, "Toggled publish status successfully")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}