import models.Status;
import play.Play;
import play.Play.Mode;
import play.jobs.Job;
import play.jobs.OnApplicationStart;
import play.test.Fixtures;


@OnApplicationStart
public class Bootstrap extends Job {
 
    public void doJob() {
        // Check if the database is empty
    	if(Play.mode == Mode.DEV){
    		if(Status.count() == 0) {
    			Fixtures.load("initial-data.yml");
    		}
    	}
    }
 
}
