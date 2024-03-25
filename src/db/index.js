import mongoose from "mongoose";
import { DBNAME } from "../constant.js";


const connectDB = async () => {
    try {
        
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DBNAME}`);
        console.log(`Mongodb connected Successfully :: ${connectionInstance.connection.host}`);
        
    } catch (error) {
        console.log("MongoDB db connection failed :: ", error);
        process.exit(1);
    }
}
export default connectDB;