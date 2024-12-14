ARG OE_VERSION
FROM node:20.9

## dependencies for running vscode extension tests
RUN apt-get update \
    && apt-get install -y --no-install-recommends libasound2 libgbm1 libgtk-3-0 libnss3 vulkan-tools \
    && apt-get install -y --no-install-recommends xauth xvfb xauth rsync ant jq dbus \
    && apt-get install -y --no-install-recommends gh pipx \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

## dependencies for running bats tests
RUN echo "JAVA_HOME=$(which java)" > /psc/dlc/properties/java.properties

## create directory for vscode-test which will be a mounted volume
RUN mkdir -p ~/.vscode-test

## install xq (via yq) for xml parsing
RUN pipx install yq
ENV PATH=$PATH:/root/.local/bin

WORKDIR /home/circleci/project
