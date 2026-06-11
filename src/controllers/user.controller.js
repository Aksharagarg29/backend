import {asyncHandler} from '../utils/asyncHandler.js';
import {APIerror} from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import {uploadToCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/apiResponse.js"


const registerUser = asyncHandler(async (req, res) => {
    
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

export { registerUser }


    //get user details
    //validations - not null
    //user already exist : username, email
    //check for images - avatar(required) and coverimage
    //upload them to cloudinary
    //create user entry in db
    //remove pswd and refresh token from res to user
    //check for user creation
    //return res