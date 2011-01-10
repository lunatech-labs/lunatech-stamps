package controllers;

import java.util.ArrayList;
import java.util.List;

import play.mvc.Controller;

public class Application extends Controller {

    public static void index() {
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
}