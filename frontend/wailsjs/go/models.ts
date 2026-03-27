export namespace main {
	
	export class Video {
	    id: number;
	    title: string;
	    coverPath: string;
	    videoPath: string;
	    duration: string;
	    artist: string;
	    description: string;
	    releaseYear: string;
	    screenshotPath: string;
	    is_favorite: boolean;
	    last_played_at: string;
	    is_group: number;
	
	    static createFrom(source: any = {}) {
	        return new Video(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.coverPath = source["coverPath"];
	        this.videoPath = source["videoPath"];
	        this.duration = source["duration"];
	        this.artist = source["artist"];
	        this.description = source["description"];
	        this.releaseYear = source["releaseYear"];
	        this.screenshotPath = source["screenshotPath"];
	        this.is_favorite = source["is_favorite"];
	        this.last_played_at = source["last_played_at"];
	        this.is_group = source["is_group"];
	    }
	}

}

