import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {APIerror} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    const commentAggregate = await Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
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
                            userName: 1,
                            fullName: 1,
                            avatar: 1
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
            $project: {
                content: 1,
                owner: 1
            }
        }
    ])

    const comments = await Comment.aggregatePaginate(commentAggregate,
        {
            page: pageNum,
            limit: limitNum
        }
    )
    return res
    .status(200)
    .json(
        new ApiResponse(200, comments, "comments fetched successfully")
    )
})

const addComment = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    if(!videoId){
        throw new APIerror(400, "video not found")
    }

    const {content} = req.body
    if(!content){
        throw new APIerror(400, "content is required")
    }
    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    })
    if(!comment){
        throw new APIerror(400, "Something went wrong while publishing the comment")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, comment, "comment added successfully")
    )
    
})

const updateComment = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if(!commentId){
        throw new APIerror(400, "comment id is missing")
    }
    
    const {comment} = req.body
    if(!comment){
        throw new APIerror(400, "comment is required")
    }

    const storedComment = await Comment.findById(commentId)

    if(!storedComment){
        throw new APIerror(400, "comment not exists")
    }

    if(storedComment.owner.toString() !== req.user?._id.toString()){
        throw new APIerror(400, "not authorized to update this comment")
    }
    const updatedComment = await Comment.findByIdAndUpdate(
        commentId, 
        {
            $set: {
                comment
            }
        },
        {new: true}
    )
    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
    )
    
})

const deleteComment = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if(!commentId){
        throw new APIerror(400, "comment id is missing")
    }

    const storedComment = await Comment.findById(commentId)

    if(!storedComment){
        throw new APIerror(400, "comment not exists")
    }

    if(storedComment.owner.toString() !== req.user?._id.toString()){
        throw new APIerror(400, "not authorized to delete this comment")
    }
    await Comment.findByIdAndDelete(
        commentId
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Comment deleted successfully")
    )
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }