import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});   

const uploadToCloudinary = async (localFilePath)=>{
    try{
        if(!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type : "auto",
        });
        fs.unlinkSync(localFilePath)
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);
        return null;
    }
}

const deleteOldImage = async (oldImage, resourceType = "image") => {
    try {
        if(!oldImage) return null;
        const url = oldImage.file;
        if (!url) return null 
            
        const urlParts = url.split("/");
        const publicId = urlParts.slice(-2).join("/").split(".")[0]; 
        await cloudinary.uploader.destroy(publicId,{
            resource_type: resourceType
        });

        
    } catch (error) {
        return null
    }
}

export {uploadToCloudinary, deleteOldImage};