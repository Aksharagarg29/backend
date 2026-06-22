import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {APIerror} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comment.model.js"
import {Tweet} from "../models/tweet.model.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    if(!videoId){
        throw new APIerror(400, "video id is missing")
    }

    if(!mongoose.isValidObjectId(videoId)){
        throw new APIerror(400, "invalid video id")
    }
    const video = await Video.findById(videoId);
    if (!video) {
        throw new APIerror(404, "video not found");   
    }

    const likedBy = req.user?._id;

    const likedBefore = await Like.findOne({
        video: videoId, likedBy
    })
    
    let likedVideo;

    if(!likedBefore){
        likedVideo = await Like.create({
            likedBy,
            video: videoId
        })

        if(!likedVideo){
            throw new APIerror(404, "Something went wrong while liking the video")
        }
    }else{
        await Like.findOneAndDelete({
            video: videoId, likedBy
        })
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, likedVideo, "toggled video like")
    )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if(!commentId){
        throw new APIerror(400, "comment id is missing")
    }

    if(!mongoose.isValidObjectId(commentId)){
        throw new APIerror(400, "invalid comment id")
    }
    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new APIerror(404, "comment not found");   
    }

    const likedBy = req.user?._id;

    const likedBefore = await Like.findOne({
        comment: commentId, likedBy
    })
    
    let likedComment;

    if(!likedBefore){
        likedComment = await Like.create({
            likedBy,
            comment: commentId
        })
        if(!likedComment){
            throw new APIerror(404, "Something went wrong while liking the comment")
        }
    }else{
        await Like.findOneAndDelete({
            comment: commentId, likedBy
        })
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, likedComment, "toggled comment like")
    )

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if(!tweetId){
        throw new APIerror(400, "tweet id is missing")
    }

    if(!mongoose.isValidObjectId(tweetId)){
        throw new APIerror(400, "invalid tweet id")
    }
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new APIerror(404, "tweet not found");   
    }

    const likedBy = req.user?._id;

    const likedBefore = await Like.findOne({
        tweet: tweetId, likedBy
    })
    
    let likedTweet;

    if(!likedBefore){
        likedTweet = await Like.create({
            likedBy,
            tweet: tweetId
        })
        if(!likedTweet){
            throw new APIerror(404, "Something went wrong while liking the tweet")
        }
    }else{
        await Like.findOneAndDelete({
            tweet: tweetId, likedBy
        })
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, likedTweet, "toggled tweet like")
    )
}
)

const getLikedVideos = asyncHandler(async (req, res) => {

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
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
                                        userName: 1,
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
                    }
                ]
            }
        },
        {
            $addFields: {
                video: {
                    $first: "$video"
                }
            }
        }
    ])

    if(!likedVideos.length){
        return res.status(200).json(new ApiResponse(200, [], "no videos liked yet"))
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    )
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}

