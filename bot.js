"use strict"

const express = require("express")
const bodyParser = require("body-parser")

const api = require("./api")
const Conversation = require("./conversation")

const conversations = {}

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get("/webhook", function(request, response) {
	if (request.query["hub.mode"] === "subscribe" && request.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
		console.log("Webhook validated!")
		response.status(200).send(request.query["hub.challenge"])
	}
	else {
		console.error("Webhook validation failed.")
		response.sendStatus(403)
	}
})

app.post("/webhook", function(request, response) {
	console.log("IN: ", JSON.stringify(request.body, null, "  ")) // FIXME

	const data = request.body
	if (data.object === "page") {
		data.entry.forEach(function(entry) {
			entry.messaging.forEach(function(event) {
				const senderId = event.sender && event.sender.id
				if (senderId) {
					const conversation = conversations[senderId] || (conversations[senderId] = new Conversation(senderId))

					if (event.message) {
						switch (event.message.text) {
						case "state": // FIXME for debugging only
							conversation.sendTextMessage("My current state is: " + conversation.state)
							break

						case "reset": // FIXME for debugging only
							conversation.state = "neutral"
							conversation.sendTextMessage("I'm back to start :)")
							break

						default:
							const success = conversation.handleMessage(event.message.text || "", event.message.attachments)
							if (!success) {
								conversation.sendTextMessage("Sorry, I don't understand what you mean 😓")
							}

							return
						}
					}
					else if (event.postback) {
						conversation.handlePostback(event.postback.payload, event.postback.referrer)
						return
					}
				}

				console.log("Webhook received unknown event: ", event)
			})
		})
	}

	response.sendStatus(200)
})


const server = app.listen(process.env.PORT || 3000, function() {
	console.log("Listening on port %s", server.address().port)

	api.updateMessengerProfile({
		"get_started": {
			"payload": "GET_STARTED"
		}
	})
})
