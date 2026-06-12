import { useEffect, useState } from "react";
import api from "../services/api";

export default function useApiResource(path, errorMessage) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isCurrentRequest = true;

    api.get(path)
      .then((response) => {
        if (isCurrentRequest) {
          setData(response.data);
          setStatus("success");
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setStatus("error");
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [errorMessage, path, reloadToken]);

  const reload = () => {
    setStatus("loading");
    setReloadToken((currentToken) => currentToken + 1);
  };

  return {
    data,
    error: status === "error" ? errorMessage : "",
    isLoading: status === "loading",
    reload,
  };
}
