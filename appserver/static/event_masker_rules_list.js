require.config({
    paths: {
        EventMaskerListerView: "../app/event_masker/views/EventMaskerRuleListerView"
    }
});

require([
        "jquery",
        "underscore",
        "backbone",
        "EventMaskerListerView",
        "splunkjs/mvc/simplexml/ready!"
    ], function ($, _, Backbone, EventMaskerListerView) {
        var EventMaskerListerView = new EventMaskerListerView({
            'el': $("#event_masker_rules"),
            'app': 'event_masker',
            'collection': 'event_masker_rules',
            'editor': 'masker_rules_edit',
            'allow_editing_collection': true
        });

        EventMaskerListerView.render();
    }
);
