entity_id = data.get('entity_id')
command = data.get('command')
params = str(data.get('params'))
parsedParams = []

for z in params.replace(' ', '').replace('],[', '|').replace('[', '').replace(']', '').split('|'):
    rect = []
    for c in z.split(','):
        rect.append(int(c))
    parsedParams.append(rect)

if command == "app_goto_target":
    parsedParams = parsedParams[0]

hass.services.call('vacuum', 'send_command',
                   {'entity_id': entity_id, 'command': command, 'params': parsedParams}, True)
