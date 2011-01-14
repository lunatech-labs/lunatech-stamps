package models;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import play.mvc.Router;

public class StatusesJSON {

	public ArrayList<StatusJSON> updates;
	public Author author;
	public List<AtomLink> links = new ArrayList<AtomLink>();

	public StatusesJSON(List<Status> updates, Author author) {
    	this.updates = new ArrayList<StatusJSON>(updates.size());
    	for(Status update : updates)
    		this.updates.add(new StatusJSON(update));
    	this.author = author;
		setupAtomLinks();
	}

	private void setupAtomLinks(){
		Map<String, Object> idMap = new HashMap<String, Object>();
		idMap.put("id", author.id);
		links.add(new AtomLink("add-status", Router.getFullUrl("Application.addStatus", idMap)));
	}

}
