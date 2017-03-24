"use strict"

const express = require("express")
const bodyParser = require("body-parser")
const request = require("request")
const path = require("path")

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
				if (event.message) {
					handleMessageEvent(event)
				}
				else if (event.postback) {
					handlePostbackEvent(event)
				}
				else {
					console.log("Webhook received unknown event: ", event)
				}
			})
		})
	}

	response.sendStatus(200)
})


function handleMessageEvent(event) {
	const senderId = event.sender.id
	const message = event.message
	const messageText = message.text
	const messageAttachments = message.attachments

	if (messageText) {
		const matchingText = messageText.toLowerCase()
		if (matchingText.indexOf("lend") >= 0 && matchingText.indexOf("camera") >= 0) {
			sendTextMessage(senderId, "Awesome! Can you send me a photo of it?")
		}
		else if (matchingText.indexOf("too") >= 0 && matchingText.indexOf("low") >= 0) {
			sendTextMessage(senderId, "What do you think it’s worth?")
		}
		else if (matchingText.indexOf("400") >= 0) {
			sendTextMessage(senderId, "Okay, seems reasonable.")
			setTimeout(function() {
				sendTextMessage(senderId, "For how long would you like to lend it out?")
			}, 1000)
		}
		else if (messageText.indexOf("2 days")) {
			sendTextMessage(senderId, "Sure, we can do that!")
			setTimeout(function() {
				sendTextMessage(senderId, "Share this link with your friend:")
				sendGenericTemplate(senderId, {
						elements: [{
							title:   "TITLE",
							buttons: [{
								type:           "element_share",
								share_contents: {
									attachment: {
										type:    "template",
										payload: {
											template_type: "generic",
											elements:      [{
												title:   "TITLE",
												buttons: [{
													"type":  "web_url",
													"title": "Test",
													"url":   "https://www.messenger.com/t/1138492269610888?ref=abc"
												}]
											}]
										}
									}
								}
							}]
						}]
					}
				)
				setTimeout(function() {
					sendTextMessage(senderId, "I’ll write you once your friend has accepted your request.")
				}, 3000)
			}, 1000)
		}
	}
	else if (messageAttachments) {
		sendTextMessage(senderId, "One sec, let me check it out…")
		setTimeout(function() {
			sendTextMessage(senderId, "Cool Nikon! I’d estimate it to be worth $250. Are you okay with that?")
		}, 3000)
	}
}


function handlePostbackEvent(event) {
	const senderId = event.sender.id

	const payload = event.postback.payload
	switch (payload) {
	case "GET_STARTED":
		const reference = event.postback.referral && event.postback.referral.ref
		if (reference) {
			sendTextMessage(senderId, "Lender would like to lend out their camera to you.")
			sendTextMessage(senderId, "The following price covers damage and theft. Is that okay?")
			sendGenericTemplate(senderId, {
				elements: [{
					title:    "Nikon Camera",
					subtitle: "Lender would like to lend Nikon Camera with you for 2 days.",
					buttons:  [{
						type:  "web_url",
						title: "Accept & Pay",
						url:   "https://www.paypal.com"
					}]
				}]
			})
		}
		else {
			sendTextMessage(senderId, "Hey Lender, how can I help you?")
		}
		break

	default:
		console.error("Unexpected postback event: ", payload)
	}
}


function sendTextMessage(recipientId, text, properties) {
	callMessagesApi({
		recipient: { id: recipientId },
		message:   Object.assign({ text: text }, properties)
	})
}


function sendGenericTemplate(recipientId, properties) {
	callMessagesApi({
		recipient: { id: recipientId },
		message:   {
			attachment: {
				type:    "template",
				payload: Object.assign({ template_type: "generic" }, properties)
			}
		}
	})
}


function callMessagesApi(messageData) {
	request({
		uri:    "https://graph.facebook.com/v2.6/me/messages",
		qs:     { access_token: process.env.PAGE_ACCESS_TOKEN },
		method: "POST",
		json:   messageData

	}, function(error, response) {
		if (!error && response.statusCode === 200) {
			// success
		}
		else {
			console.error("Unable to send message.")
			console.error(response)
			console.error(error)
		}
	})
}


function callMessengerProfileApi(data) {
	request({
		uri:    "https://graph.facebook.com/v2.6/me/messenger_profile",
		qs:     { access_token: process.env.PAGE_ACCESS_TOKEN },
		method: "POST",
		json:   data

	}, function(error, response) {
		if (!error && response.statusCode === 200) {
			// success
		}
		else {
			console.error("Unable to update messenger profile.")
			console.error(response.body)
			console.error(error)
		}
	})
}


app.listen(process.env.PORT || 3000, function() {
	console.log("Listening on port %s", server.address().port)

	callMessengerProfileApi({
		"get_started": {
			"payload": "GET_STARTED"
		}
	})
})
