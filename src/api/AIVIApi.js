import axiosClient from "./axiosClient";
/**
 */
class AIVI {
  constructor(table) {
    this.baseUrl = table;
  }
  baseUrl = "";
  /**
   * UpDate Status
   */
  sendChatInput = (user_input) => {
    try {
      return axiosClient.post(this.baseUrl + "/chat", { user_input });
    } catch (error) {
      console.log(error);
    }
  };
  /**
   * UpDate Priority
   */
  radio = (filename) => {
    try {
      return axiosClient.get(this.baseUrl + "/audio/" + filename, {
        responseType: "blob", // Để tải file về
      });
    } catch (error) {
      console.log(error);
    }
  };
}

export default AIVI;
