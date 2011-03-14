package controllers;

import java.lang.reflect.Type;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;

import models.Author;
import models.Comment;
import models.CommentJSON;
import models.Status;
import models.StatusJSON;
import models.StatusesJSON;

import play.Logger;
import play.data.binding.As;
import play.db.jpa.JPABase;
import play.mvc.Controller;

public class Application extends Controller {

    private static final String SIETSE = "sietse@lunatech.com";
	private static final String NICO = "nicolas@lunatech.com";
	public static final String STEF = "stef@lunatech.com";

	public static void index() {
        render();
    }

	public static void test() {
        render();
    }

	public static void docs() {
        render();
    }

    public static void data() throws InterruptedException{
    	Thread.sleep(1000);
    	List<String> data = new ArrayList<String>();
    	data.add("first");
    	data.add("second");
    	data.add("third");
    	renderJSON(data);
    }
    
    public static void facebook(){
    	render();
    }
    
    public static class DateSerializer implements JsonSerializer<Date> {
		
    	private DateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ");
		
    	@Override
		public JsonElement serialize(Date date, Type arg1,
				JsonSerializationContext arg2) {
			return new JsonPrimitive(format.format(date));
		}
	}
    
    public static void statusUpdates(@As("yyyy-MM-dd'T'HH:mm:ss.SSSZ") Date since){
    	Logger.info("Date: "+ since);
    	List<Status> updates;
    	if(since != null){
    		updates = Status.find("date > ? ORDER BY date DESC", since).fetch();
    	}else
    		updates = Status.find("ORDER BY date DESC").fetch();
    	Author author = Author.find("email", STEF).first();
    	renderJSON(new StatusesJSON(updates, author), new DateSerializer());
    }
    
    public static void deleteComment(Long id){
    	Comment.findById(id)._delete();
    }

    public static void addComment(Long id, String value){
    	Status status = Status.findById(id);
    	Author author = Author.find("email", STEF).first();
    	Comment comment = new Comment(author, value);
    	comment.status = status;
    	comment.save();
    	renderJSON(new CommentJSON(comment), new DateSerializer());
    }
    
    public static void deleteStatus(Long id){
    	Status.findById(id)._delete();
    }

    public static void addStatus(Long id, String value){
    	Author author = Author.findById(id);
    	Status status = new Status(author, value);
    	status.save();
    	renderJSON(new StatusJSON(status), new DateSerializer());
    }

    public static void on(){
    	Logger.info("on called");
    	renderText("on");
    }
    
    public static void off(){
    	Logger.info("off called");
    	renderText("off");
    }

    public static void state(){
    	Logger.info("state called");
    	renderText("off");
    }
}