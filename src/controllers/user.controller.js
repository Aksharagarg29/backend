import {asyncHandler} from '../utils/asyncHandler.js';
import {APIerror} from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import {uploadToCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/apiResponse.js"
import jwt from JsonWebTokenError
import { JsonWebTokenError } from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new APIerror(500, "something went wrong while generating tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //get user details
    //validations - not null
    //user already exist : username, email
    //check for images - avatar(required) and coverimage
    //upload them to cloudinary
    //create user entry in db
    //remove pswd and refresh token from res to user
    //check for user creation
    //return res
    
    const {fullName, email, userName, password} = req.body;

    if(
        [fullName, email, userName, password].some((field)=>{field?.trim() === ""})
    ){
        throw new APIerror(400, "Fields should not be empty");
    }

    const existedUser = await User.findOne({
        $or: [{ userName },{ email }]
    })

    if(existedUser){
        throw new APIerror(409, "User with this email or username already exists");
    }
    console.log(req.files)

    const avatarLocalPath = req.files?.avatar[0]?.path

    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new APIerror(400, "Avatar file is required");
    }

    const avatar = await uploadToCloudinary(avatarLocalPath);
    const coverImage = await uploadToCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new APIerror(400, "Avatar file is required");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        userName: userName.toLowerCase(),
        email,
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new APIerror(500, "Something went wrong while registering the user");
    }

    console.log("user registered");

    return res.status(201).json(
        new ApiResponse(201, "User registered successfully", createdUser)
    )

})

const loginUser = asyncHandler(async (req, res) => {
    //get username or email from the use
    //check if this username exists in db - no->throw error of register first
    //yes -> password check
    //accesstoken and refreshtoken 
    //send them through cookies
    //when accesstoken expires, get password info from rereshtoken


    const {userName, email, password} = req.body;
    if(!(userName || email)){
        throw new APIerror(400, "username or email is required")
    }
    const user = await User.findOne({
        $or: [{userName}, {email}]
    })
    if(!user){
        throw new APIerror(404, "user not registered")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new APIerror(404, "password is incorrect")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "Logged in Successfully"
        )
    )


})

const logOutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User Logged Out")
    )
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new APIerror(401, "Unauthorized request");
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken, 
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new APIerror(401, "Invalid refresh token")
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new APIerror(401, "Refresh token is expired or used")
        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken : newRefreshToken },
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new APIerror(401, error?.message || "Invalid refresh Token")
    }


})

export { registerUser, loginUser, logOutUser, refreshAccessToken }


   