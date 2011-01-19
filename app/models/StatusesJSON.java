package models;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import play.mvc.Router;

public class StatusesJSON {

	public ArrayList<StatusJSON> updates;
	public Author author;
	public List<AtomLink> links = new ArrayList<AtomLink>();
	public Date lastRefresh;

	public StatusesJSON(List<Status> updates, Author author) {
    	this.updates = new ArrayList<StatusJSON>(updates.size());
    	for(Status update : updates)
    		this.updates.add(new StatusJSON(update));
    	this.author = author;
    	if(!updates.isEmpty())
    		lastRefresh = updates.get(0).date;
    	else{
    		// MAX doesn't work in HSQL
    		lastRefresh = (Date)Status.find("SELECT date FROM Status ORDER BY date DESC").first();
    		if(lastRefresh == null)
    			lastRefresh = new Date();
    	}
		setupAtomLinks();
	}

	private void setupAtomLinks(){
		Map<String, Object> idMap = new HashMap<String, Object>();
		idMap.put("id", author.id);
		links.add(new AtomLink("add-status", Router.getFullUrl("Application.addStatus", idMap)));
		links.add(new AtomLink("refresh", Router.getFullUrl("Application.statusUpdates")));
	}

}
