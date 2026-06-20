import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {APIerror} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const {content} = req.body
    if(!content){
        throw new APIerror(400, "content is required")
    }
    const tweet = await Tweet.create({
        content,
        owner: req.user?._id
    })

    if(!tweet){
        throw new APIerror(400, "Something went wrong while publishing the tweet")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, tweet, "Tweet published successfully")
    )
})

const getUserTweets = asyncHandler(async (req, res) => {
    const {userId} = req.params
    if(!userId){
        throw new APIerror(400, "user id is missing")
    }
    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
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

    return res
    .status(200)
    .json(
        new ApiResponse(200, tweets, "tweets of this user fetched successfully")
    )
})

const updateTweet = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if(!tweetId){
        throw new APIerror(400, "tweet id is missing")
    }

    const {content} = req.body
    if(!content){
        throw new APIerror(400, "content is required")
    }

    const tweet = await Tweet.findById(tweetId)
    if(!tweet){
        throw new APIerror(400, "tweet not exists")
    }

    if(tweet.owner.toString() !== req.user?._id.toString()){
        throw new APIerror(400, "not authorized to update this tweet")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content
            }
        },
        {new: true}
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedTweet, "tweet updated successfully")
    )
})

const deleteTweet = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if(!tweetId){
        throw new APIerror(400, "tweet id is missing")
    }

    const tweet = await Tweet.findById(tweetId)
    if(!tweet){
        throw new APIerror(400, "tweet not exists")
    }

    if(tweet.owner.toString() !== req.user?._id.toString()){
        throw new APIerror(400, "not authorized to delete this tweet")
    }

    await Tweet.findByIdAndDelete(tweetId)

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "tweet deleted successfully")
    )
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}