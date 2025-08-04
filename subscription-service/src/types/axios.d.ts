export interface axiosRequest { 
  body?:any ;
  method?: string;
  endpoint?: string;
  data?: any;
  libraryID?: number;
  libraryApiKey?: string;
  videoBufferLength?: number;
  fileName?: string;
  videoBuffer?: any;
  headers?: any;
  query?: any;
  params?: any;
  videoID?: string;
  thumbnailUrl?: string;
}
