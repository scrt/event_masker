require.config({
    paths: {
        EventMaskerFormView: "../app/event_masker/views/EventMaskerFormView"
    }
});

require([
        "jquery",
        "underscore",
        "backbone",
        "EventMaskerFormView",
        "splunkjs/mvc/simplexml/ready!"
    ], function ($, _, Backbone, EventMaskerFormView) {
        var EventMaskerFormView = new EventMaskerFormView({
            'el': $("#event_masker_form"),
            'app': 'event_masker',
            'collection': 'event_masker_rules',
            'lister': 'masker_rules',
            'list_link_title': 'Back to Rule List',
            'list_link': 'masker_rules'
        });

        EventMaskerFormView.render();
    }
);
