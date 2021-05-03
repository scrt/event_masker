require.config({
    paths: {
        EventMaskerRuleEditorView: "../app/event_masker/views/EventMaskerRuleEditorView"
    }
});

require([
        "jquery",
        "underscore",
        "backbone",
        "EventMaskerRuleEditorView",
        "splunkjs/mvc/simplexml/ready!"
    ], function ($, _, Backbone, EventMaskerRuleEditorView) {
        var EventMaskerRuleEditorView = new EventMaskerRuleEditorView({
            'el': $("#event_masker_rules_editor"),
            'app': 'event_masker',
            'collection': 'event_masker_rules',
            'lister': 'masker_rules',
            'list_link_title': 'Back to Rule List',
            'list_link': 'masker_rules'
        });

        EventMaskerRuleEditorView.render();
    }
);
